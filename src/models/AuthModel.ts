import { Model } from 'mongoose';
import { AuthEntity } from '../types/auth.js';
import { BaseModel, BaseDocument } from '../base/BaseModel.js';

export interface AuthDocument extends AuthEntity, BaseDocument {
    _id: string;
}

class AuthModelClass extends BaseModel<AuthDocument> {
    constructor() {
        const authSchemaDefinition = {
            username: {
                type: String,
                required: true,
                unique: true,
            },
            password: {
                type: String,
                required: true,
            },
        }
        super('Auth', authSchemaDefinition, 'auths');
        this.addAuthIndexes();
    }

    private addAuthIndexes(): void {
        this.addCustomIndex({ username: 1 });
        this.addCustomIndex({ password: 1 });
    }
}

export interface AuthModel extends Model<AuthDocument> {}

const authModelInstance = new AuthModelClass();

export const AuthModel = authModelInstance.getModel() as AuthModel;

export default AuthModel;