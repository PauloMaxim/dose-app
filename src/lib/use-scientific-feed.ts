import { useCallback, useEffect, useState } from "react";
import { readMyScientificFeed } from "@/server/scientific/feed-service";
import {
  presentScientificFeedItem,
  type ScientificFeedPresentation,
} from "./scientific-feed-presentation";

type FeedState =
  | { status: "loading"; items: ScientificFeedPresentation[] }
  | { status: "ready"; items: ScientificFeedPresentation[] }
  | { status: "error"; items: ScientificFeedPresentation[] };

export function useScientificFeed(pageSize = 25) {
  const [request, setRequest] = useState(0);
  const [state, setState] = useState<FeedState>({ status: "loading", items: [] });
  const retry = useCallback(() => setRequest((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setState({ status: "loading", items: [] });
    void readMyScientificFeed({
      data: { asOf: new Date().toISOString(), pageSize, mode: "recent" },
    }).then(
      (feed) => {
        if (active) setState({ status: "ready", items: feed.items.map(presentScientificFeedItem) });
      },
      () => {
        if (active) setState({ status: "error", items: [] });
      },
    );
    return () => {
      active = false;
    };
  }, [pageSize, request]);

  return { ...state, retry };
}
