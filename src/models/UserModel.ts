import { Model } from 'mongoose';
import { UserEntity } from '../types/user.js';
import { BaseModel, BaseDocument } from '../base/BaseModel.js';

export interface UserDocument extends UserEntity, BaseDocument {
    _id: string;
}

class UserModelClass extends BaseModel<UserDocument> {
    constructor() {
        const userSchemaDefinition = {
            authId: {
                type: String,
                required: true,
                unique: true,
            },
            displayName: {
                type: String,
                required: true,
                trim: true,
            },
            email: {
                type: String,
                required: false,
                unique: true,
                sparse: true, // null値は許可
                lowercase: true,
                trim: true,
            },
            avatar: {
                type: String,
                required: false,
            },
            type: {
                type: String,
                required: true,
                enum: ['admin', 'moderator', 'user', 'guest'],
                default: 'user',
            },
            settings: {
                private: {
                    type: Boolean,
                    default: false,
                },
                notifications: {
                    type: Boolean,
                    default: true,
                },
                theme: {
                    type: String,
                    enum: ['light', 'dark', 'auto'],
                    default: 'auto',
                },
                language: {
                    type: String,
                    default: 'ja',
                },
            },
            isOnline: {
                type: Boolean,
                default: false,
            },
            lastSeen: {
                type: Date,
                default: Date.now,
            },
        }
        super('User', userSchemaDefinition, 'users');
        this.addUserIndexes();
    }

    private addUserIndexes(): void {
        this.addCustomIndex({ authId: 1 });
        this.addCustomIndex({ email: 1 });
        this.addCustomIndex({ displayName: 1 });
        this.addCustomIndex({ type: 1 });
        this.addCustomIndex({ isOnline: 1 });
        this.addCustomIndex({ lastSeen: 1 });
        this.addCustomIndex({ 'settings.private': 1 });
    }
}

export interface UserModel extends Model<UserDocument> {}

const userModelInstance = new UserModelClass();

export const UserModel = userModelInstance.getModel() as UserModel;

export default UserModel;
