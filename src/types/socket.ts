import { Socket } from "socket.io";
import { AuthEntity } from './auth.js';

export interface CustomSocket extends Socket {
    token?: string;
    username?: string;
    user?: AuthEntity;
}