import type { TelemetrieVideoSoc } from '../tipuri/soc'

export function stareImagine(video: TelemetrieVideoSoc | null): string {
  if (!video || video.stale) return 'Date indisponibile'
  switch (video.image_state) {
    case 'persistent_anomaly': return 'Degradare persistentă'
    case 'atypical_sample': return video.quality_issue ? 'Degradare în verificare' : 'Abatere ML; degradare neconfirmată'
    case 'normal': return 'Normală'
    default: return video.is_anomaly ? 'Eșantion atipic' : 'Normală'
  }
}
