import type { NotifyMessages } from '../vi/notify';

export const notify: NotifyMessages = {
  'notify.followNewVideo': '{name} vient de publier une vidéo',
  'notify.newComment': '{name} a commenté : {text}',
  'notify.newReply': '{name} vous a répondu : {text}',
  'notify.voucherIssued': 'Vous avez reçu un bon pour un Kiot gratuit pendant 1 an !',
  'notify.videoReady': 'Votre vidéo est publiée',
  'notify.videoDraftReady': 'Votre vidéo est prête et enregistrée dans les brouillons',
  'notify.videoScheduled': "Votre vidéo est prête et sera publiée à l'heure prévue",
  'notify.videoPublished': 'Votre vidéo programmée est en ligne',
  'notify.draftExpiring': 'Un brouillon sera supprimé dans {days} jours',
  'notify.videoFailed': 'Votre vidéo n’a pas pu être publiée',
  'notify.videoRemoved': 'Votre vidéo a été retirée',
  'notify.profileCleared':
    'Votre photo de profil, votre photo de couverture et votre bio ont été retirées pour non-respect des règles',
  'notify.reason': 'Motif : {reason}',
  'notify.title': 'Notifications',
  'notify.empty': 'Aucune notification pour l’instant.',
  'notify.xuReward': 'Vous gagnez {xu} xu grâce à {viewers} spectateurs valides pendant votre live.',
  'notify.xuSkipped.TOO_SHORT': 'Votre live était trop court : pas de xu cette fois.',
  'notify.xuSkipped.NOT_ENOUGH_VIEWERS':
    'Votre live a eu {viewers} spectateurs valides, pas assez pour une récompense en xu.',
  'notify.xuSkipped.DAILY_LIMIT': 'Vous avez déjà reçu des xu aujourd’hui ; ce live n’en ajoute pas.',
  'notify.xuSkipped.BUDGET': 'Le budget de xu du mois est épuisé ; votre live ne reçoit pas de xu.',
  'notify.xuSkipped.STOPPED': 'Votre live a été arrêté par 9MUA : pas de xu.',
};
