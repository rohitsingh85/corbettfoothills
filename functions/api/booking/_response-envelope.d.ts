export interface InnPilotSuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface InnPilotErrorEnvelope {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

export function unwrapInnPilotData<T>(payload: InnPilotSuccessEnvelope<T>): T;
export function unwrapInnPilotData(payload: InnPilotErrorEnvelope): InnPilotErrorEnvelope;
export function unwrapInnPilotData<T>(payload: T): T;
