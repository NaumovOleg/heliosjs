export const context = {
  awsRequestId: 'local-req-id-123456',
  functionName: 'localFunction',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:local:123456789012:function:localFunction',
  memoryLimitInMB: '128',
  logGroupName: '/aws/lambda/localFunction',
  logStreamName: '2023/01/01/[$LATEST]abcdefghijk',
  getRemainingTimeInMillis: () => 30000,
  callbackWaitsForEmptyEventLoop: true,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};
