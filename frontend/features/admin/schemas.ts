import { z } from 'zod';

const currentYear = new Date().getFullYear();

export const bikeSchema = z.object({
  title: z.string().trim().min(3, 'At least 3 characters').max(120),
  brand: z.string().trim().min(2, 'Required').max(60),
  model: z.string().trim().min(1, 'Required').max(80),
  year: z.coerce.number().int().min(1950).max(currentYear + 1),
  engineCC: z.coerce.number().int().min(50, 'At least 50 cc').max(3000),
  kilometers: z.coerce.number().int().min(0).max(1_000_000),
  owners: z.coerce.number().int().min(1).max(10),
  location: z.string().trim().min(2, 'Required').max(80),
  description: z.string().trim().min(10, 'Add a few details (10+ characters)').max(5000),
});

export type BikeFormValues = z.infer<typeof bikeSchema>;

const rupees = z.coerce.number({ invalid_type_error: 'Enter an amount' }).int('Whole rupees').positive('Must be positive');

/** Form values use datetime-local strings; they are converted to ISO (UTC) on submit. */
export const auctionSchema = z
  .object({
    bikeId: z.string().uuid('Select a bike'),
    startingPrice: rupees,
    reservePrice: z.union([z.literal(''), rupees]).optional(),
    minimumIncrement: rupees,
    startsAt: z.string().min(1, 'Required'),
    endsAt: z.string().min(1, 'Required'),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), { message: 'Must be after the start time', path: ['endsAt'] })
  .refine((v) => v.reservePrice === '' || v.reservePrice === undefined || v.reservePrice >= v.startingPrice, {
    message: 'Reserve cannot be below the starting price',
    path: ['reservePrice'],
  });

export type AuctionFormValues = z.input<typeof auctionSchema>;

export interface AuctionFormOutput {
  bikeId: string;
  startingPrice: number;
  reservePrice: number | null;
  minimumIncrement: number;
  startsAt: string;
  endsAt: string;
}

export function toAuctionPayload(values: z.output<typeof auctionSchema>): AuctionFormOutput {
  return {
    bikeId: values.bikeId,
    startingPrice: values.startingPrice,
    reservePrice: values.reservePrice === '' || values.reservePrice === undefined ? null : values.reservePrice,
    minimumIncrement: values.minimumIncrement,
    startsAt: new Date(values.startsAt).toISOString(),
    endsAt: new Date(values.endsAt).toISOString(),
  };
}

/** Date → value for <input type="datetime-local"> in the user's time zone. */
export function toLocalInput(date: Date | string): string {
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}
