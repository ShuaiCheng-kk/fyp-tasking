import { reviewsRepository } from '@/repositories/marketing/reviewsRepository'
import { marketingAdminService } from '@/services/marketingadmin/marketingAdminService'
import { CreateReviewInput, Review, ReviewSummary } from '@/types/Review'

const MAX_REVIEW_LENGTH = 2000
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const reviewsService = {
  async submitReview(input: CreateReviewInput): Promise<Review> {
    if (!input.rating || input.rating < 1 || input.rating > 5) {
      throw new Error('Rating must be between 1 and 5')
    }

    const review = input.review?.trim() ?? ''
    if (review.length === 0) {
      throw new Error('Review text is required')
    }
    if (review.length > MAX_REVIEW_LENGTH) {
      throw new Error(`Review must be ${MAX_REVIEW_LENGTH} characters or fewer`)
    }

    const email = input.email?.trim()
    if (email && !EMAIL_PATTERN.test(email)) {
      throw new Error('Email address is invalid')
    }

    return reviewsRepository.createReview({
      name: input.name?.trim() || undefined,
      email: email || undefined,
      rating: input.rating,
      review,
    })
  },

  async getFeaturedReviews(limit = 12): Promise<ReviewSummary[]> {
    return reviewsRepository.listApprovedReviews(limit)
  },

  // Admin moderation below — every method re-verifies the caller is a Marketing Admin
  // via marketingAdminService.verifyMarketingAdmin, same pattern as marketingAdminService itself.
  async listAllReviewsForAdmin(admin_user_id: string): Promise<Review[]> {
    await marketingAdminService.verifyMarketingAdmin(admin_user_id)
    return reviewsRepository.listAllReviews()
  },

  async approveReview(admin_user_id: string, review_id: string): Promise<Review> {
    await marketingAdminService.verifyMarketingAdmin(admin_user_id)
    return reviewsRepository.setReviewApproval(review_id, true)
  },

  async rejectReview(admin_user_id: string, review_id: string): Promise<Review> {
    await marketingAdminService.verifyMarketingAdmin(admin_user_id)
    return reviewsRepository.setReviewApproval(review_id, false)
  },

  // Reserved for the future AI feature to flag its picks for the carousel.
  async setFeatured(admin_user_id: string, review_id: string, featured: boolean): Promise<Review> {
    await marketingAdminService.verifyMarketingAdmin(admin_user_id)
    return reviewsRepository.setReviewFeatured(review_id, featured)
  },

  async deleteReview(admin_user_id: string, review_id: string): Promise<void> {
    await marketingAdminService.verifyMarketingAdmin(admin_user_id)
    await reviewsRepository.deleteReview(review_id)
  },
}