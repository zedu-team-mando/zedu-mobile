import { useState, useCallback, useEffect, useRef } from 'react';
import { ACTIONS } from '@/store/types';
import { useDataContext } from '@/store/useDataContext';
import { GetRequest } from '@/utils/requests';

interface Props {
  channel_id: string;
}

const UseChannelChat = ({ channel_id }: Props) => {
  const { state, dispatch } = useDataContext();
  const [page, setPage] = useState(1);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const currentChannelId = useRef(channel_id);
  const previousChannelId = useRef(channel_id);
  const isFetchingMoreRef = useRef(false);
  const requestGeneration = useRef(0);
  const lastFailedRequestAt = useRef(0);

  currentChannelId.current = channel_id;

  useEffect(() => {
    let isActive = true;
    const channelChanged = previousChannelId.current !== channel_id;
    previousChannelId.current = channel_id;
    currentChannelId.current = channel_id;
    setPage(1);
    setHasMore(true);
    requestGeneration.current += 1;
    isFetchingMoreRef.current = false;
    setIsFetchingMore(false);

    if (channelChanged) {
      dispatch({
        type: ACTIONS.CHANNELS_CHAT,
        payload: { data: [], page: 1 },
      });
    }

    const getChat = async () => {
      const { data, error } = await GetRequest(
        `/threads/channels/${channel_id}?page=1&limit=50`,
      );
      if (
        !error &&
        data &&
        isActive &&
        currentChannelId.current === channel_id
      ) {
        dispatch({
          type: ACTIONS.CHANNELS_CHAT,
          payload: {
            data: data.data,
            page: 1,
          },
        });
        setPage(1);
        const paginationDetails = Array.isArray(data.pagination)
          ? data.pagination[0]
          : data.pagination;
        if (paginationDetails?.total_pages_count != null) {
          setHasMore(Number(paginationDetails.total_pages_count) > 1);
        } else {
          setHasMore((data.data?.length || 0) === 50);
        }
      }
    };
    getChat();
    return () => {
      isActive = false;
    };
  }, [channel_id, state?.channelCallback, dispatch]);

  const loadMore = useCallback(async () => {
    if (
      isFetchingMoreRef.current ||
      !hasMore ||
      (state?.channelsChat?.length || 0) < 50 ||
      Date.now() - lastFailedRequestAt.current < 1000
    )
      return;

    isFetchingMoreRef.current = true;
    setIsFetchingMore(true);
    const requestId = ++requestGeneration.current;
    const nextPage = page + 1;

    try {
      const { data, error } = await GetRequest(
        `/threads/channels/${channel_id}?page=${nextPage}&limit=50`,
      );

      if (!error && data?.data && currentChannelId.current === channel_id) {
        const freshMessages = data.data;
        const paginationDetails = Array.isArray(data.pagination)
          ? data.pagination[0]
          : data.pagination;

        dispatch({
          type: ACTIONS.CHANNELS_CHAT,
          payload: {
            data: freshMessages,
            page: nextPage,
          },
        });

        setPage(nextPage);

        if (paginationDetails?.total_pages_count != null) {
          setHasMore(nextPage < Number(paginationDetails.total_pages_count));
        } else {
          setHasMore(freshMessages.length === 50);
        }
        lastFailedRequestAt.current = 0;
      } else if (error && currentChannelId.current === channel_id) {
        lastFailedRequestAt.current = Date.now();
      }
    } catch (err) {
      console.error(err);
      if (currentChannelId.current === channel_id) {
        lastFailedRequestAt.current = Date.now();
      }
    } finally {
      if (requestGeneration.current === requestId) {
        isFetchingMoreRef.current = false;
      }
      if (
        requestGeneration.current === requestId &&
        currentChannelId.current === channel_id
      ) {
        setIsFetchingMore(false);
      }
    }
  }, [channel_id, page, hasMore, dispatch, state?.channelsChat]);

  return { loadMore, isFetchingMore };
};

export default UseChannelChat;
