const trimTrailingSlash = (value) => value.replace(/\/+$/, "");

export const getCouchDbRoot = () => {
  const configured = trimTrailingSlash(
    (process.env.REACT_APP_COUCHDB_URL || "/couchdb").trim()
  );

  if (typeof window === "undefined") {
    return configured;
  }

  try {
    const parsed = new URL(configured, window.location.origin);
    const path = trimTrailingSlash(parsed.pathname);

    if (window.location.protocol === "https:" && path.endsWith("/couchdb")) {
      return path;
    }
  } catch (error) {
    // Fall through to the configured value for non-URL strings.
  }

  return configured;
};

export const getAppDbName = () => process.env.REACT_APP_COUCHDB_DB || "baseball";

export const getUsersDbName = () => process.env.REACT_APP_USERS_DB || "users";

export const getAppDbBase = () => `${getCouchDbRoot()}/${getAppDbName()}`;

export const getUsersDbBase = () => `${getCouchDbRoot()}/${getUsersDbName()}`;
