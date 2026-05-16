import { logEvent } from "firebase/analytics";
import { analyticsPromise } from "../firebase.js";

function trackEvent(eventName, properties = {}) {
  analyticsPromise
    .then((analytics) => {
      if (!analytics) return;
      logEvent(analytics, eventName, properties);
    })
    .catch((e) => {
      console.warn("[analytics] Failed to log event:", eventName, e?.message ?? e);
    });
}

export const track = {
  discAdded(properties = {}) {
    trackEvent("disc_added", properties);
  },
  discRemoved(properties = {}) {
    trackEvent("disc_removed", properties);
  },
  bagCreated(properties = {}) {
    trackEvent("bag_created", properties);
  },
  discAddedToBag(properties = {}) {
    trackEvent("disc_added_to_bag", properties);
  },
  discRemovedFromBag(properties = {}) {
    trackEvent("disc_removed_from_bag", properties);
  },
  gapFinderOpened(properties = {}) {
    trackEvent("gap_finder_opened", properties);
  },
  gapSuggestionViewed(properties = {}) {
    trackEvent("gap_suggestion_viewed", properties);
  },
  gapFinderCompleted(properties = {}) {
    trackEvent("gap_finder_completed", properties);
  },
  buyLinkClicked(properties = {}) {
    trackEvent("buy_link_clicked", properties);
  },
};
