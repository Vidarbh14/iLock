using System;
using System.Runtime.Versioning;
using System.Speech.Synthesis;
using Microsoft.Extensions.Logging;

namespace ILock.WindowsAgent.Access
{
    [SupportedOSPlatform("windows")]
    public static class VoiceBroadcaster
    {
        public static bool Speak(string text, int rate = 0, int volume = 100, ILogger? logger = null)
        {
            if (string.IsNullOrWhiteSpace(text)) return false;

            try
            {
                logger?.LogInformation("Speaking text (Length={Len}, Rate={Rate}, Volume={Vol})", text.Length, rate, volume);

                using var synth = new SpeechSynthesizer();
                synth.Rate = Math.Clamp(rate, -10, 10);
                synth.Volume = Math.Clamp(volume, 0, 100);

                // Select installed voice if available
                var voices = synth.GetInstalledVoices();
                foreach (var voice in voices)
                {
                    if (voice.Enabled)
                    {
                        synth.SelectVoice(voice.VoiceInfo.Name);
                        break;
                    }
                }

                synth.Speak(text);
                return true;
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Failed to speak text via SpeechSynthesizer");
                return false;
            }
        }
    }
}
