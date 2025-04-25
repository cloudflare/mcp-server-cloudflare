import { z } from 'zod'

export const StoreIdParam = z
		.string()
		.describe(
			"The storeId of the Secrets Store present in the user's Cloudflare account."
		)