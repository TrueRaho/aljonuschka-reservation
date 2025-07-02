export interface Reservation {
    id: number
    first_name: string
    last_name: string
    phone: string
    email: string
    reservation_date: string
    reservation_time: string
    guests: number
    special_requests?: string
  }
  