import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    console.log("Event: ", JSON.stringify(event));
    const parameters = event?.pathParameters;
    const queryParams = event?.queryStringParameters; //get query parameters

    const movieId = parameters?.movieId
      ? parseInt(parameters.movieId)
      : undefined;
    const role = parameters?.role;

    if (!movieId || !role) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "Missing movieId or role" }),
      };
    }

    const queryCommandInput: QueryCommandInput = {
      TableName: process.env.CREW_TABLE_NAME,
      KeyConditionExpression: "movieId = :movieId AND crewRole = :crewRole",
      ExpressionAttributeValues: {
        ":movieId": movieId,
        ":crewRole": role,
      },
    };

    const queryCommandOutput = await ddbDocClient.send(
      new QueryCommand(queryCommandInput)
    );

    if (!queryCommandOutput.Items || queryCommandOutput.Items.length === 0) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          Message: "None found in role and movie",
        }),
      };
    }

    //get crew names
    let crewNames = queryCommandOutput.Items.flatMap((item) =>
        (item.names as string).split(",").map((name) => name.trim())
      );
  
      //filter by name using query params
      if (queryParams?.name) {
        const nameSubstring = queryParams.name.toLowerCase(); //string you enter is lowercase
        crewNames = crewNames.filter((name) =>
          name.toLowerCase().includes(nameSubstring) //crewNames are lowercase and checks if substring is in crewNames
        );
      }

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        movieId,
        role,
        crew: crewNames,
      }),
    };
  } catch (error: any) {
    console.error(JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({error}),
    };
  }
};

function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}
