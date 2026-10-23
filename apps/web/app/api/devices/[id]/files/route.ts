import { getAuthenticatedUserId, errorResponse, jsonResponse } from '@/lib/api-helpers';
import { isSupabaseConfigured, createServiceClient } from '@/lib/supabase-server';
import { demoStore } from '@/lib/demo-store';
import { FileConduitSchema } from '@ilock/shared';
import crypto from 'node:crypto';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId && isSupabaseConfigured()) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id: deviceId } = params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const folder = searchParams.get('folder') || 'desktop';

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();

      if (action === 'read') {
        const { data: fileReadReq } = await supabase
          .from('authorization_requests')
          .select('result_error, acknowledged_at, result_status')
          .eq('device_id', deviceId)
          .eq('is_acknowledged', true)
          .eq('result_status', 'FILE_READ')
          .order('acknowledged_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fileReadReq && fileReadReq.result_error) {
          return jsonResponse({
            success: true,
            contentBase64: fileReadReq.result_error,
            updatedAt: fileReadReq.acknowledged_at,
          });
        }
      } else {
        const { data: latest } = await supabase
          .from('authorization_requests')
          .select('result_error, acknowledged_at, result_status')
          .eq('device_id', deviceId)
          .eq('is_acknowledged', true)
          .eq('result_status', 'FILE_LIST')
          .order('acknowledged_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latest && latest.result_error) {
          try {
            const parsed = JSON.parse(latest.result_error);
            return jsonResponse({
              success: true,
              folder,
              files: parsed,
              updatedAt: latest.acknowledged_at,
            });
          } catch {}
        }
      }
    }

    // Default demo files when none captured yet
    const demoFiles = [
      { name: 'Financial_Report_Q3.pdf', size: 1048576, modified: new Date(Date.now() - 3600000).toISOString(), folder, isDir: false },
      { name: 'System_Architecture.docx', size: 524288, modified: new Date(Date.now() - 7200000).toISOString(), folder, isDir: false },
      { name: 'Encrypted_Backup.kdbx', size: 2097152, modified: new Date(Date.now() - 86400000).toISOString(), folder, isDir: false },
      { name: 'Notes.txt', size: 4096, modified: new Date(Date.now() - 1800000).toISOString(), folder, isDir: false },
    ];

    return jsonResponse({
      success: true,
      folder,
      files: demoFiles,
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId && isSupabaseConfigured()) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id: deviceId } = params;
    const body = await request.json();
    const parseResult = FileConduitSchema.safeParse(body);
    if (!parseResult.success) {
      return errorResponse('VALIDATION_ERROR', 'Invalid file conduit payload', 400, parseResult.error.format());
    }

    const conduitData = parseResult.data;
    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

    if (isSupabaseConfigured()) {
      const supabase = createServiceClient();
      const { data: device, error: devErr } = await supabase
        .from('devices')
        .select('id, owner_id')
        .eq('id', deviceId)
        .single();

      if (devErr || !device || (userId && device.owner_id !== userId)) {
        return errorResponse('FORBIDDEN', 'Access denied to this workstation', 403);
      }

      await supabase.from('authorization_requests').insert({
        device_id: deviceId,
        command_type: 'DEVICE_PING',
        nonce,
        payload: {
          action: 'FILE_CONDUIT',
          fileAction: conduitData.action,
          folder: conduitData.folder,
          fileName: conduitData.fileName,
          contentBase64: conduitData.contentBase64,
          requestedBy: userId,
        },
        expires_at: expiresAt,
      });

      return jsonResponse({
        success: true,
        message: `File conduit command '${conduitData.action}' dispatched`,
      });
    }

    demoStore.queueCommand({
      id: crypto.randomUUID(),
      deviceId,
      sessionId: null,
      commandType: 'DEVICE_PING',
      nonce,
      payload: {
        action: 'FILE_CONDUIT',
        fileAction: conduitData.action,
        folder: conduitData.folder,
        fileName: conduitData.fileName,
        contentBase64: conduitData.contentBase64,
      },
      signature: null,
      isDispatched: false,
      dispatchedAt: null,
      isAcknowledged: false,
      acknowledgedAt: null,
      resultStatus: null,
      resultError: null,
      expiresAt,
      createdAt: new Date().toISOString(),
    });

    return jsonResponse({
      success: true,
      message: `File conduit command queued (demo mode)`,
    });
  } catch (err: any) {
    return errorResponse('INTERNAL_SERVER_ERROR', err.message, 500);
  }
}
