// The boundary for the segment below reservations/, so a list → detail navigation
// shows the spinner in the first frame instead of leaving the old page on
// screen until the RSC payload arrives.
import { LoadingState } from "@/components/LoadingState"

export default function ReservationsLoading() {
    return <LoadingState size="page" message="Loading reservation…" />
}
