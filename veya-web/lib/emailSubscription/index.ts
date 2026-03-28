export type {
  EmailLikeInput,
  SubscriptionScoreResult,
  SubscriptionType,
} from "./types";
export { scoreSubscription } from "./scoreSubscription";
export {
  normalizeEmailBody,
  normalizeSubject,
  stripHtmlToPlain,
  buildSearchBlob,
} from "./normalize";
export { resolveServiceNameAndCategory } from "./resolveMerchant";
export { computeSignalFlags } from "./evidence";
export { SUBSCRIPTION_WEIGHTS, THRESHOLD_RECURRING_CANDIDATE } from "./weights";
