import { useCallback, useReducer } from "react";
import type { ArtTransform } from "./canvas-transform";

export type ArtTransformAction =
  | { type: "set"; value: ArtTransform }
  | { type: "patch"; value: Partial<ArtTransform> }
  | { type: "move"; dxMm: number; dyMm: number }
  | { type: "rotate"; deltaDeg: number }
  | { type: "scaleUniform"; delta: number; min?: number }
  | { type: "reset" };

export const reduceArtTransform = (
  state: ArtTransform,
  action: ArtTransformAction,
  initial: ArtTransform
): ArtTransform => {
  switch (action.type) {
    case "set":
      return action.value;
    case "patch":
      return { ...state, ...action.value };
    case "move":
      return {
        ...state,
        xMm: state.xMm + action.dxMm,
        yMm: state.yMm + action.dyMm
      };
    case "rotate":
      return {
        ...state,
        rotation: state.rotation + action.deltaDeg
      };
    case "scaleUniform": {
      const min = action.min ?? 0.05;
      return {
        ...state,
        scaleX: Math.max(min, state.scaleX + action.delta),
        scaleY: Math.max(min, state.scaleY + action.delta)
      };
    }
    case "reset":
      return initial;
    default:
      return state;
  }
};

export const getNextArtTransform = (
  current: ArtTransform,
  action: ArtTransformAction,
  initial: ArtTransform
) => reduceArtTransform(current, action, initial);

export const useArtTransform = (initial: ArtTransform) => {
  const [artTransform, rawDispatch] = useReducer(
    (state: ArtTransform, action: ArtTransformAction) =>
      reduceArtTransform(state, action, initial),
    initial
  );

  const dispatchTransform = useCallback(
    (action: ArtTransformAction) => rawDispatch(action),
    []
  );

  const setTransform = useCallback(
    (value: ArtTransform) => rawDispatch({ type: "set", value }),
    []
  );

  const resetTransform = useCallback(() => rawDispatch({ type: "reset" }), []);

  return {
    artTransform,
    dispatchTransform,
    setTransform,
    resetTransform
  };
};
