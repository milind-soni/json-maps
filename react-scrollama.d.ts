declare module "react-scrollama" {
  import type { ReactNode } from "react";

  interface ScrollamaProps {
    offset?: number;
    threshold?: number;
    onStepEnter?: (response: { data: number; direction: string; element: HTMLElement }) => void;
    onStepExit?: (response: { data: number; direction: string; element: HTMLElement }) => void;
    onStepProgress?: (response: { data: number; progress: number; direction: string; element: HTMLElement }) => void;
    children: ReactNode;
  }

  interface StepProps {
    data?: number;
    children: ReactNode;
  }

  export function Scrollama(props: ScrollamaProps): JSX.Element;
  export function Step(props: StepProps): JSX.Element;
}
