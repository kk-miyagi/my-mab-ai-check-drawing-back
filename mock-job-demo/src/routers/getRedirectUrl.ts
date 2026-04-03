import { PersistedState } from "../types/uploadContext";
import { localStorageKey } from '../constants/localStorageKey';

export const getRedirectUrl = (): string | undefined => {
  try {
    const defaultLocalStorage = JSON.parse(window.localStorage.getItem(localStorageKey.default) as string) as PersistedState
    
    // if (!defaultLocalStorage.demoFlag && defaultLocalStorage.lastEpic === 'create-label' && defaultLocalStorage.lastOperation === 'batch-create-label' && defaultLocalStorage.status === 'start') return '/create-label-processing'
    // // if (!defaultLocalStorage.demoFlag && defaultLocalStorage.lastEpic === 'create-label' && defaultLocalStorage.lastOperation === 'batch-create-label' && defaultLocalStorage.status === 'end') return '/create-label-result'
    // if (!defaultLocalStorage.demoFlag && defaultLocalStorage.lastEpic === 'create-label' && defaultLocalStorage.lastOperation === 'batch-create-label' && defaultLocalStorage.status === 'error') return '/create-label'
    // if (!defaultLocalStorage.demoFlag && defaultLocalStorage.lastEpic === 'create-label' && defaultLocalStorage.lastOperation === 'open-update-label-screen' && defaultLocalStorage.status === 'start') return '/update-label'
    // if (defaultLocalStorage.demoFlag && defaultLocalStorage.lastEpic === 'create-label' && defaultLocalStorage.lastOperation === 'batch-create-label' && defaultLocalStorage.status === 'doing') return '/demo-create-label-processing'
    // if (defaultLocalStorage.demoFlag && defaultLocalStorage.lastEpic === 'create-label' && defaultLocalStorage.lastOperation === 'batch-create-label' && defaultLocalStorage.status === 'end') return '/demo-create-label-result'

    // const drawingReviewLocalStorage = JSON.parse(window.localStorage.getItem(localStorageKey.drawingReview) as string) as PersistedState
    // if (!drawingReviewLocalStorage.demoFlag && drawingReviewLocalStorage.lastEpic === 'drawing-review' && drawingReviewLocalStorage.lastOperation === 'batch-drawing-review' && drawingReviewLocalStorage.status === 'start') return '/drawing-review-processing'
    // if (!drawingReviewLocalStorage.demoFlag && drawingReviewLocalStorage.lastEpic === 'drawing-review' && drawingReviewLocalStorage.lastOperation === 'batch-drawing-review' && drawingReviewLocalStorage.status === 'end') return '/drawing-review-result'
  } catch {
    /* noop */
  }
  return undefined;
};
