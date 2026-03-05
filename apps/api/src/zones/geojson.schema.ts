import { z } from 'zod';

const positionSchema = z.tuple([z.number(), z.number()]);

const linearRingSchema = z
  .array(positionSchema)
  .min(4)
  .refine((positions) => {
    const first = positions[0];
    const last = positions[positions.length - 1];
    return first[0] === last[0] && first[1] === last[1];
  }, 'Polygon linear ring must start and end at the same coordinate');

export const polygonGeoJsonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(linearRingSchema).min(1),
});

export type PolygonGeoJson = z.infer<typeof polygonGeoJsonSchema>;
