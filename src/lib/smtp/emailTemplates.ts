export function getEmailTemplate(type: 'confirmed' | 'rejected' | 'undo'): { subject: string, html: string } {
    switch (type) {
      case 'confirmed':
        return {
          subject: 'confirmed',
          html: `Template confirmed`
        }
      case 'rejected':
        return {
          subject: 'rejected',
          html: `Template rejected`
        }
      case 'undo':
        return {
          subject: 'undo',
          html: `Template undo`
        }
      default:
        throw new Error('Unknown email type')
    }
}