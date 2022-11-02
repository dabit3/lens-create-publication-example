import { ApolloClient, InMemoryCache, gql, createHttpLink } from '@apollo/client'
import { utils, ethers } from 'ethers'
import { setContext } from '@apollo/client/link/context';
import omitDeep from 'omit-deep'
import LENS_HUB_ABI from './ABI.json'

export const LENS_HUB_CONTRACT = "0xDb46d1Dc155634FbC732f92E853b10B288AD5a1d"
export const lensHub = new ethers.Contract(LENS_HUB_CONTRACT, LENS_HUB_ABI, getSigner())

const API_URL = 'https://api.lens.dev'

// export const client = new ApolloClient({
//   uri: API_URL,
//   cache: new InMemoryCache()
// })

/* configuring Apollo GraphQL Client */
const authLink = setContext((_, { headers }) => {
  const token = window.localStorage.getItem('lens-auth-token')
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

/* GraphQL queries and mutations */
export async function createPostTypedDataMutation (request, token) {
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
  return result.data.createPostTypedData
}

export const createPostTypedData = gql`
mutation createPostTypedData($request: CreatePublicPostRequest!) {
  createPostTypedData(request: $request) {
    id
    expiresAt
    typedData {
      types {
        PostWithSig {
          name
          type
        }
      }
      domain {
        name
        chainId
        version
        verifyingContract
      }
      value {
        nonce
        deadline
        profileId
        contentURI
        collectModule
        collectModuleInitData
        referenceModule
        referenceModuleInitData
      }
    }
  }
}
`

export const challenge = gql`
  query Challenge($address: EthereumAddress!) {
    challenge(request: { address: $address }) {
      text
    }
  }
`

export const authenticate = gql`
  mutation Authenticate(
    $address: EthereumAddress!
    $signature: Signature!
  ) {
    authenticate(request: {
      address: $address,
      signature: $signature
    }) {
      accessToken
      refreshToken
    }
  }
`

export const getDefaultProfile = gql`
query DefaultProfile($address: EthereumAddress!) {
  defaultProfile(request: { ethereumAddress: $address}) {
    id
    handle
  }
}
`

export const validateMetadata = gql`
query ValidatePublicationMetadata ($metadatav2: PublicationMetadataV2Input!) {
  validatePublicationMetadata(request: {
    metadatav2: $metadatav2
  }) {
    valid
    reason
  }
}
`

/* helper functions */
function getSigner() {
  if (typeof window !== "undefined") {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner()
    return signer
  }
  return null
}

export const signedTypeData = (
  domain,
  types,
  value,
) => {
  const signer = getSigner();
  return signer._signTypedData(
    omit(domain, '__typename'),
    omit(types, '__typename'),
    omit(value, '__typename')
  )
}

export function omit (object, name) {
  return omitDeep(object, name);
};

export const splitSignature = (signature) => {
  return utils.splitSignature(signature)
}

export const signCreatePostTypedData = async (request, token) => {
  const result = await createPostTypedDataMutation(request, token)
  const typedData = result.typedData
  const signature = await signedTypeData(typedData.domain, typedData.types, typedData.value);
  return { result, signature };
}
