import type { PolicySet } from './types';

// English translation of the Vietnamese draft (vi.ts). The Vietnamese text is the official version.
export const en: PolicySet = {
  'quy-che': {
    title: '9MUA marketplace operating rules',
    summary: 'General rules for buyers, sellers and 9MUA on 9mua.com.',
    sections: [
      {
        heading: 'About 9MUA',
        paragraphs: [
          '9mua.com is an e-commerce marketplace operated by {company} (tax code {taxId}, address {office}).',
          'Each seller opens a shop called a Kiot, with its own address like yourkiot.9mua.com. Products from active Kiots also appear together on the 9MUA Market.',
          '9MUA does not sell goods itself. Sellers are responsible for their products, prices, descriptions and delivery. 9MUA holds the money buyers pay and only pays the seller once the transaction is complete.',
        ],
      },
      {
        heading: 'Accounts',
        paragraphs: [
          'You sign up with a phone number, email or Google account and keep your password secret. Sign-up information must be truthful.',
          'Each person only uses their own account. 9MUA may lock accounts that break these rules.',
        ],
      },
      {
        heading: 'Opening a Kiot',
        paragraphs: [
          'The Kiot fee is {kiotFee} per year (about 1 USD, converted at Vietcombank’s USD selling rate), paid by QR code. A Kiot is active for 1 year from payment; renewing early adds to the remaining time.',
          'If it expires without renewal, the Kiot is hidden; products and data are kept so it can be reopened.',
          'Sellers provide a contact phone number and a payout bank account in the account holder’s exact name. When needed, 9MUA asks for ID card verification before transferring money.',
        ],
      },
      {
        heading: 'What may be sold',
        paragraphs: [
          'Only legal goods with a clear origin that match their description.',
          'Prohibited: counterfeit or imitation goods, goods banned from trade under Vietnamese law, prescription drugs, weapons, illegal substances, wildlife, obscene content and any other goods prohibited by law.',
          'No false advertising, and no medical claims for food or cosmetics.',
        ],
      },
      {
        heading: 'Fees',
        paragraphs: [
          'Buyers pay no fees to 9MUA.',
          'Sellers pay the Kiot fee and a platform fee of {platformFee} of the goods value of each completed order. Minimum withdrawal is {payoutMin}, withdrawal fee {payoutFee}.',
        ],
      },
      {
        heading: 'Content moderation',
        paragraphs: [
          'Products, videos or comments reported by 5 different people are hidden automatically until 9MUA reviews them.',
          '9MUA may remove content and lock Kiots or accounts that break the rules, and tells the people concerned why.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: ['Hotline {hotline} · Email {email} · Office {office}.'],
      },
    ],
  },
  'dieu-khoan': {
    title: 'Terms of use',
    summary: 'By using 9mua.com you agree to the terms below.',
    sections: [
      {
        heading: 'Agreement',
        paragraphs: [
          'By creating an account or using 9mua.com, you agree to these terms, the operating rules and the marketplace policies.',
        ],
      },
      {
        heading: 'Content you post',
        paragraphs: [
          'You keep the rights to the photos, videos and descriptions you post, and allow 9MUA to show them on the marketplace and in shared links.',
          'Only post content you have the right to use, that does not infringe copyright, insult others or break the law.',
        ],
      },
      {
        heading: 'AI Studio',
        paragraphs: [
          'Descriptions, images and videos made by AI are suggestions only. Kiot owners read, edit and take responsibility for them before pressing Sell. The AI never posts for you.',
        ],
      },
      {
        heading: 'Prohibited behaviour',
        paragraphs: [
          'Creating fake accounts to get vouchers or inflate likes or views; spam; payment fraud; impersonating others; attacking or disrupting the system.',
        ],
      },
      {
        heading: 'Responsibility',
        paragraphs: [
          '9MUA is an intermediary that holds payments and helps resolve complaints. Sellers are responsible for the quality of their goods and their obligations to buyers.',
          '9MUA works to keep the service running but may pause it for maintenance or unexpected incidents.',
        ],
      },
      {
        heading: 'Changes',
        paragraphs: [
          'When these terms change, 9MUA updates this page with the date. Continuing to use the marketplace after that date means you accept the new version.',
          'These terms are governed by the laws of Vietnam.',
        ],
      },
    ],
  },
  'bao-mat': {
    title: 'Privacy policy',
    summary: 'What information 9MUA collects, why, and how it is protected.',
    sections: [
      {
        heading: 'What we collect',
        paragraphs: [
          'Phone number or email, display name, password (stored with one-way encryption, nobody can read it), delivery address and order information.',
          'For sellers: contact phone, pickup address, payout bank account, and ID card photos when verifying (stored separately, only the CEO can view them).',
          'Video views, likes, follows and comments, used to suggest content.',
        ],
      },
      {
        heading: 'How we use it',
        paragraphs: [
          'To process orders, payments, delivery and refunds, prevent fraud, and send system emails (receipts, renewal reminders, password resets).',
          'Sellers only see the buyer’s name, phone and delivery address for orders placed with their own Kiot.',
        ],
      },
      {
        heading: 'Who we share it with',
        paragraphs: [
          'The PayOS payment gateway (bank transfers), our email service, and sellers (delivery details of their orders).',
          'AI Studio only sends the product name, category and notes typed by the Kiot owner to the AI providers (Anthropic, Google). No customer, order or money data is sent.',
          '9MUA does not sell your personal data.',
        ],
      },
      {
        heading: 'Cookies',
        paragraphs: [
          '9MUA uses cookies to keep you signed in, remember your language and your cart. No third-party advertising cookies.',
        ],
      },
      {
        heading: 'Protection',
        paragraphs: [
          'HTTPS connections, encrypted passwords, temporary lock after repeated wrong logins, mandatory two-factor authentication for administration, daily backups.',
        ],
      },
      {
        heading: 'Your rights',
        paragraphs: [
          'View and edit your information on the Account page. To delete your account, email {email}; transaction records are kept for the period required by accounting and tax law.',
        ],
      },
    ],
  },
  'doi-tra': {
    title: 'Returns and refunds policy',
    summary: 'Buyers’ money is held by 9MUA until the order is complete.',
    sections: [
      {
        heading: 'Money held safely',
        paragraphs: [
          'The money you pay stays with 9MUA. 9MUA only pays the seller after you receive the goods and the 7-day complaint period ends.',
        ],
      },
      {
        heading: 'Automatic refunds',
        paragraphs: [
          'If the seller does not confirm within 48 hours of payment, the seller cancels, or you pay late after the item sold out, the order moves to awaiting refund.',
        ],
      },
      {
        heading: 'Faulty, wrong, missing or undelivered goods',
        paragraphs: [
          'Within 7 days after the order shows "Delivered", open My orders, press "Report a problem", describe it and attach up to 3 photos.',
          '9MUA reviews it, contacts both sides and decides whether to refund you or pay the seller.',
        ],
      },
      {
        heading: 'Exchanges',
        paragraphs: [
          'Size or model exchanges are agreed with the seller. If you cannot agree, file a complaint and 9MUA will help.',
        ],
      },
      {
        heading: 'Receiving a refund',
        paragraphs: [
          'Enter your refund bank account on the order page. 9MUA transfers the full amount you paid and updates the order when done.',
          'After 7 days without a complaint, the order is complete and the seller has been paid; contact the seller directly after that.',
        ],
      },
    ],
  },
  'khieu-nai': {
    title: 'Complaint resolution policy',
    summary: 'How to file a complaint and how 9MUA handles it.',
    sections: [
      {
        heading: 'Where to complain',
        paragraphs: [
          'About an order: the "Report a problem" button in My orders, within 7 days after the order shows "Delivered".',
          'About a product, video or comment that breaks the rules: the "Report" button on that content.',
          'Anything else: hotline {hotline} or email {email}.',
        ],
      },
      {
        heading: 'How 9MUA handles it',
        paragraphs: [
          'While an order is under complaint, its money is held and paid to no one.',
          '9MUA reviews the buyer’s description and photos and the seller’s delivery details (tracking code), contacts both sides if needed, then refunds the buyer or pays the seller. The result is shown in the app and on the order.',
        ],
      },
      {
        heading: 'If you disagree',
        paragraphs: [
          'The parties may continue to negotiate, use mediation, or ask the competent state authorities to resolve the matter under Vietnamese law.',
        ],
      },
    ],
  },
  'van-chuyen': {
    title: 'Shipping policy',
    summary: 'Sellers ship their own orders; 9MUA tracks the order deadlines.',
    sections: [
      {
        heading: 'Who ships',
        paragraphs: [
          'Each Kiot ships itself or chooses its own carrier. Shipping fees are set by each Kiot, may be free above an order value, and are shown before you order.',
        ],
      },
      {
        heading: 'Deadlines',
        paragraphs: [
          'The seller confirms within 48 hours of your payment, then ships and enters a tracking code (if any).',
          'When you receive the goods, press "I received the order". Otherwise the order becomes "Delivered" automatically 10 days after shipping.',
        ],
      },
      {
        heading: 'Address and damage',
        paragraphs: [
          'Enter your delivery address and phone correctly. Goods damaged or lost in transit are handled under the Returns and refunds policy.',
        ],
      },
    ],
  },
  'thanh-toan': {
    title: 'Payment policy',
    summary: 'Buyers pay 9MUA by QR code; 9MUA pays sellers when orders complete.',
    sections: [
      {
        heading: 'Buyers pay',
        paragraphs: [
          'You pay 9MUA with a bank-transfer QR code (PayOS gateway) that works with any banking app. The code is valid for 15 minutes; after that the order is cancelled and the items go back to the Kiot.',
          'Prices on 9MUA are always in VND.',
          'Do not pay sellers directly outside the marketplace: 9MUA cannot protect off-platform transactions.',
        ],
      },
      {
        heading: 'Sellers get paid',
        paragraphs: [
          'When an order completes (delivered and 7-day complaint period over), the goods value minus the {platformFee} platform fee is added to the Kiot balance.',
          'Sellers withdraw to a bank account in their exact name, minimum {payoutMin} per withdrawal, fee {payoutFee}.',
        ],
      },
      {
        heading: 'Kiot fee',
        paragraphs: [
          '{kiotFee} per year, paid by QR code with an emailed receipt. The price is converted from 1 USD at Vietcombank’s rate; a QR code already created keeps its price.',
        ],
      },
      {
        heading: 'Wrong amount transferred',
        paragraphs: [
          'If you transfer less or more than the QR code amount, the system alerts 9MUA and 9MUA will contact you to sort it out.',
        ],
      },
    ],
  },
};
