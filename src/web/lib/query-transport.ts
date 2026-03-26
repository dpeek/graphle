import {
  defaultHttpSerializedQueryPath,
  HttpSerializedQueryClientError,
  requestSerializedQuery,
  type HttpSerializedQueryClientOptions,
  type QueryResultPage,
  type SerializedQueryRequest,
} from "@io/core/graph";

export const webSerializedQueryPath = defaultHttpSerializedQueryPath;

export type SerializedQueryClientOptions = HttpSerializedQueryClientOptions;
export type SerializedQueryResultPage = QueryResultPage;
export type WebSerializedQueryRequest = SerializedQueryRequest;

export { HttpSerializedQueryClientError as SerializedQueryClientError };
export { requestSerializedQuery };
