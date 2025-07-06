export interface EmailReservation {
    id: number
    first_name: string
    last_name: string
    phone: string
    email: string
    reservation_date: string
    reservation_time: string
    guests: number
    special_requests?: string
    received_at: string
    status: "pending" | "confirmed" | "rejected"
    confirmed_reservations: number
    total_guests_for_date: number
}