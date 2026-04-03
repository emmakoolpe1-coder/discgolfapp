import { logEvent } from "firebase/analytics";
import { analytics } from "../firebase.js";

export const track = {
  discAdded(properties = {}) {
    logEvent(analytics, "disc_added", properties);
  },
  discRemoved(properties = {}) {
    logEvent(analytics, "disc_removed", properties);
  },
  bagCreated(properties = {}) {
    logEvent(analytics, "bag_created", properties);
  },
  discAddedToBag(properties = {}) {
    logEvent(analytics, "disc_added_to_bag", properties);
  },
  discRemovedFromBag(properties = {}) {
    logEvent(analytics, "disc_removed_from_bag", properties);
  },
  gapFinderOpened(properties = {}) {
    logEvent(analytics, "gap_finder_opened", properties);
  },
  gapSuggestionViewed(properties = {}) {
    logEvent(analytics, "gap_suggestion_viewed", properties);
  },
  gapFinderCompleted(properties = {}) {
    logEvent(analytics, "gap_finder_completed", properties);
  },
  buyLinkClicked(properties = {}) {
    logEvent(analytics, "buy_link_clicked", properties);
  },
};
