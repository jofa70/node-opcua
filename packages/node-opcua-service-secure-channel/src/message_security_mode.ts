import { MessageSecurityMode, _enumerationMessageSecurityMode } from "node-opcua-types";

export function coerceMessageSecurityMode(value?: number | string): MessageSecurityMode {
    if (value === undefined) {
        return MessageSecurityMode.None;
    }
    if (typeof value === "string") {
        const e =  _enumerationMessageSecurityMode.get(value);
        if (!e) return MessageSecurityMode.Invalid;
        return e.value as MessageSecurityMode;
    }
    return value as MessageSecurityMode;
}