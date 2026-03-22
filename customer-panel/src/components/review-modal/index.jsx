import React, { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { Dialog } from "@headlessui/react";
import { motion, AnimatePresence } from "framer-motion";
import { FaSpinner } from "react-icons/fa";
import ReviewsService from "../../services/reviewsService";
import toast from "react-hot-toast";

const ReviewModal = ({ isOpen, onClose, pid, fetchReviews }) => {
    const [hoveredStar, setHoveredStar] = useState(0);
    const [selectedStar, setSelectedStar] = useState(0);
    const [reviewText, setReviewText] = useState("");
    const [loading, setLoading] = useState(false);

    const handlePostReview = async () => {
        if (!selectedStar || !reviewText.trim()) return;

        setLoading(true);
        const payload = {
            pid,
            rating: selectedStar,
            review: reviewText,
        };

        try {
            const response = await ReviewsService.addReview(payload);
            console.log("response = ", response);

            if (response?.success) {
                toast.success("Review submitted successfully.");
                onClose();
                fetchReviews(pid)
            } else {
                toast.error(response?.message || "Failed to submit review. Please try again.");
            }
        } catch (error) {
            console.log("error = ", error);
            toast.error("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Reset state on modal close
    useEffect(() => {
        if (!isOpen) {
            setHoveredStar(0);
            setSelectedStar(0);
            setReviewText("");
            setLoading(false);
        }
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <Dialog open={isOpen} onClose={onClose} className="relative z-50">
                    <div className="fixed inset-0 bg-black/40" aria-hidden="true" />

                    <div className="fixed inset-0 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="w-full mx-auto flex justify-center"
                        >
                            <Dialog.Panel className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-lg">
                                <Dialog.Title className="text-xl font-semibold text-gray-800 mb-4">
                                    Write a Review
                                </Dialog.Title>

                                {/* Star Rating */}
                                <div className="flex justify-center mb-4">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                            key={star}
                                            size={32}
                                            className={`cursor-pointer mx-1 ${(hoveredStar || selectedStar) >= star
                                                ? "text-yellow-400"
                                                : "text-gray-300"
                                                }`}
                                            onMouseEnter={() => setHoveredStar(star)}
                                            onMouseLeave={() => setHoveredStar(0)}
                                            onClick={() => setSelectedStar(star)}
                                            fill="currentColor"
                                        />
                                    ))}
                                </div>

                                {/* Review Text */}
                                <textarea
                                    className="w-full border border-gray-300 rounded-md p-3 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-[#B5223B]"
                                    placeholder="Write your review here..."
                                    value={reviewText}
                                    onChange={(e) => setReviewText(e.target.value)}
                                />

                                {/* Action Buttons */}
                                <div className="flex justify-end gap-2 mt-6">
                                    <button
                                        className="px-4 py-2 rounded-md border text-gray-700 border-gray-300 hover:bg-gray-100 cursor-pointer"
                                        onClick={onClose}
                                        disabled={loading}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="cursor-pointer px-4 py-2 rounded-md disabled:cursor-not-allowed disabled:bg-[#B5223B]/60 bg-[#B5223B] text-white font-semibold hover:bg-[#9e1e32] flex items-center justify-center gap-2 min-w-[120px]"
                                        onClick={handlePostReview}
                                        disabled={!selectedStar || !reviewText.trim() || loading}
                                    >
                                        {loading ? (
                                            <>
                                                <FaSpinner className="animate-spin" />
                                                Posting...
                                            </>
                                        ) : (
                                            "Post Review"
                                        )}
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </motion.div>
                    </div>
                </Dialog>
            )}
        </AnimatePresence>
    );
};

export default ReviewModal;
