// Legacy route. Booking now goes through: movie detail -> showtime -> seat picker.
// Kept so old /buynow/:id links still work — it just forwards to the movie page.
import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

function Buynow() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    navigate(`/Detail/${id}#showtimes`, { replace: true });
  }, [id]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <Loader2 className="w-8 h-8 animate-spin text-red-500" />
    </div>
  );
}

export default Buynow;
