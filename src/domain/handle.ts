import { z } from "zod";

export const handleSchema = z
  .string()
  .trim()
  .min(1)
  .max(39)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);
