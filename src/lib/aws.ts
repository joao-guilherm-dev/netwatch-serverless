import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SNSClient } from '@aws-sdk/client-sns';

const ddb = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(ddb, { marshallOptions: { removeUndefinedValues: true } });
export const snsClient = new SNSClient({});
