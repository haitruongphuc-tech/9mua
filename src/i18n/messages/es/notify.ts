import type { NotifyMessages } from '../vi/notify';

export const notify: NotifyMessages = {
  'notify.followNewVideo': '{name} acaba de publicar un video',
  'notify.newComment': '{name} comentó: {text}',
  'notify.newReply': '{name} te respondió: {text}',
  'notify.voucherIssued': '¡Recibiste un cupón para un Kiot gratis por 1 año!',
  'notify.videoReady': 'Tu video ya está publicado',
  'notify.videoDraftReady': 'Tu video está listo y guardado en Borradores',
  'notify.videoScheduled': 'Tu video está listo y se publicará a la hora programada',
  'notify.videoPublished': 'Tu video programado ya está publicado',
  'notify.draftExpiring': 'Un borrador se eliminará en {days} días',
  'notify.captionsReady': 'Subtítulos automáticos listos: revísalos, corrígelos y actívalos',
  'notify.captionsSkipped': 'Tu video no recibió subtítulos automáticos',
  'notify.videoFailed': 'No se pudo publicar tu video',
  'notify.videoRemoved': 'Tu video fue retirado',
  'notify.profileCleared':
    'Tu foto de perfil, tu portada y tu biografía se retiraron por incumplir las normas',
  'notify.reason': 'Motivo: {reason}',
  'notify.title': 'Notificaciones',
  'notify.empty': 'Aún no hay notificaciones.',
  'notify.xuReward': 'Ganaste {xu} xu gracias a {viewers} espectadores válidos en tu directo.',
  'notify.xuSkipped.TOO_SHORT': 'Tu directo fue más corto del mínimo, así que esta vez no hay xu.',
  'notify.xuSkipped.NOT_ENOUGH_VIEWERS':
    'Tu directo tuvo {viewers} espectadores válidos, no alcanza para recompensa en xu.',
  'notify.xuSkipped.DAILY_LIMIT': 'Hoy ya recibiste xu; este directo no suma más.',
  'notify.xuSkipped.BUDGET': 'Se agotó el presupuesto de xu del mes; tu directo no recibe xu.',
  'notify.xuSkipped.STOPPED': '9MUA detuvo tu directo, así que no recibe xu.',
};
