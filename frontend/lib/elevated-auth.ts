export type ElevatedAuthRequest = {
  resolve: (password: string) => void;
  reject: (reason?: unknown) => void;
};

type ElevatedAuthHandler = (request: ElevatedAuthRequest) => void;

let handler: ElevatedAuthHandler | null = null;
let authenticationInProgress = false;

export function registerElevatedAuthHandler(nextHandler: ElevatedAuthHandler): () => void {
  handler = nextHandler;

  return () => {
    if (handler === nextHandler) {
      handler = null;
    }
  };
}

export function requestElevationPassword(): Promise<string> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Elevated authentication is only available in the browser."));
  }

  if (!handler) {
    return Promise.reject(new Error("Elevated authentication dialog is not available."));
  }

  if (authenticationInProgress) {
    return Promise.reject(new Error("Elevated authentication is already in progress."));
  }

  authenticationInProgress = true;

  return new Promise<string>((resolve, reject) => {
    const completeResolve = (password: string) => {
      authenticationInProgress = false;
      resolve(password);
    };

    const completeReject = (reason?: unknown) => {
      authenticationInProgress = false;
      reject(reason);
    };

    try {
      handler?.({
        resolve: completeResolve,
        reject: completeReject,
      });
    } catch (error) {
      authenticationInProgress = false;
      reject(error);
    }
  });
}
