import type { BrandSpec } from "../types";
import { STREAMING_BRANDS } from "./streaming";
import { FOOD_GROCERY_BRANDS } from "./foodGrocery";
import { TRAVEL_RIDE_BRANDS } from "./travelRide";
import { RETAIL_SHOPPING_BRANDS } from "./retailShopping";
import { SOFTWARE_SAAS_BRANDS } from "./softwareSaaS";
import { FITNESS_GAMING_BRANDS } from "./fitnessGaming";
import { NEWS_TELCO_UTILITIES_BRANDS } from "./newsTelcoUtilities";
import { EXTRA_CONSUMER_BRANDS } from "./extraConsumer";

/** Full catalog: shards are merged here for a single import surface. */
export const ALL_BRAND_SPECS: BrandSpec[] = [
  ...STREAMING_BRANDS,
  ...FOOD_GROCERY_BRANDS,
  ...TRAVEL_RIDE_BRANDS,
  ...RETAIL_SHOPPING_BRANDS,
  ...SOFTWARE_SAAS_BRANDS,
  ...FITNESS_GAMING_BRANDS,
  ...NEWS_TELCO_UTILITIES_BRANDS,
  ...EXTRA_CONSUMER_BRANDS,
];
