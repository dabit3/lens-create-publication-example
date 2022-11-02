# Posting to Lens

This is an example project that shows how to:

1. Authenticate a user with the Lens API
2. Once authenticated, publish a post to Lens using [typed data](https://eips.ethereum.org/EIPS/eip-712)

The `api.js` file has most of the helper functions needed for creating a `withSig` transaction, the GraphQL API, and the GraphQL queries and mutations.

> For this project to run, you must configure the Infura project ID and project secret.

### Sending authenticated requests

Once authenticated, you will receive an access token.

Using this access token, you can send authenticated requests to the Lens API.

Using the Apollo GraphQL client, there are two ways to do this:

1. Manually passing in headers:

```javascript
const result = await client.mutate({
  mutation: createPostTypedData,
  variables: {
    request,
  },
  context: {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
})
```

2. Configuring an Apollo Link:

```javascript
import { ApolloClient, InMemoryCache, gql, createHttpLink } from '@apollo/client'
import { setContext } from '@apollo/client/link/context';

const authLink = setContext((_, { headers }) => {
  const token = window.localStorage.getItem('your-storage-key')
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  }
})

const httpLink = createHttpLink({
  uri: API_URL
})

export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache()
})
```