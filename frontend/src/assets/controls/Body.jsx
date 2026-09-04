import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LanguageProvider } from "../../context/LanguageContext";
import { AuthProvider } from "../../context/AuthContext";
import { ThemeProvider } from "../../context/ThemeContext";
import Navbar from "./Navbar";
import Homes from "../Page/Homes";
import Products from "../Page/Products";
import Footer from "./Footer";
import Buynow from "../Detailpage/Buynow";
import Movie from "../Page/Movie";
import Login from "../Page/Login";
import MovieDetail from "../Detailpage/MovieDetail";
import Favorites from "../Detailpage/Favorite";
import Contact from "../Page/contact";
import Booking from "../Page/Booking";
import Ticket from "../Page/Ticket";
import MyBookings from "../Page/MyBookings";
import Manager from "../Page/Manager";

function Body() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LanguageProvider>
        <BrowserRouter>
          <Navbar />

          <Routes>
            <Route path="/" element={<Homes />} />
            <Route path="/Products" element={<Products />} />
            <Route path="/products" element={<Products />} />
            <Route path="/Movie" element={<Movie />} />
            <Route path="/Login" element={<Login />} />
            <Route path="/contact" element={<Contact />} />

            {/* Movie detail */}
            <Route path="/Detail/:id" element={<MovieDetail />} />

            {/* Booking flow: seat picker -> payment -> ticket */}
            <Route path="/booking/:showtimeId" element={<Booking />} />
            <Route path="/buynow/:id" element={<Buynow />} />
            <Route path="/ticket/:bookingId" element={<Ticket />} />
            <Route path="/my-bookings" element={<MyBookings />} />

            {/* Favorites */}
            <Route path="/favorites" element={<Favorites />} />

            {/* Manager area */}
            <Route path="/manager" element={<Manager />} />
          </Routes>

          <Footer />
        </BrowserRouter>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default Body;