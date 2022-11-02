import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import {
  client, challenge, authenticate, getDefaultProfile,
  signCreatePostTypedData, lensHub, splitSignature, validateMetadata
} from '../api'
import { create } from 'ipfs-http-client'
import { v4 as uuid } from 'uuid'

const projectId = process.env.NEXT_PUBLIC_PROJECT_ID
const projectSecret = process.env.NEXT_PUBLIC_PROJECT_SECRET
const auth = 'Basic ' + Buffer.from(projectId + ':' + projectSecret).toString('base64');

const ipfsClient = create({
  host: 'ipfs.infura.io',
  port: 5001,
  protocol: 'https',
  headers: {
      authorization: auth,
  },
})

export default function Home() {
  const [address, setAddress] = useState()
  const [session, setSession] = useState(null)
  const [postData, setPostData] = useState('')
  const [profileId, setProfileId] = useState('')
  const [handle, setHandle] = useState('')
  const [token, setToken] = useState('')
  useEffect(() => {
    checkConnection()
  }, [])
  async function checkConnection() {
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const accounts = await provider.listAccounts()
    if (accounts.length) {
      setAddress(accounts[0])
      const response = await client.query({
        query: getDefaultProfile,
        variables: { address: accounts[0] }
      })
      setProfileId(response.data.defaultProfile.id)
      setHandle(response.data.defaultProfile.handle)
    }
  }
  async function connect() {
    const account = await window.ethereum.send('eth_requestAccounts')
    if (account.result.length) {
      setAddress(account.result[0])
      const response = await client.query({
        query: getDefaultProfile,
        variables: { address: accounts[0] }
      })
      setProfileId(response.data.defaultProfile.id)
      setHandle(response.data.defaultProfile.handle)
    }
  }
  async function login() {
    try {
      const challengeInfo = await client.query({
        query: challenge,
        variables: {
          address
        }
      })
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner()
      const signature = await signer.signMessage(challengeInfo.data.challenge.text)
      const authData = await client.mutate({
        mutation: authenticate,
        variables: {
          address, signature
        }
      })

      const { data: { authenticate: { accessToken }}} = authData
      localStorage.setItem('lens-auth-token', accessToken)
      setToken(accessToken)
      setSession(authData.data.authenticate)
    } catch (err) {
      console.log('Error signing in: ', err)
    }
  }
  async function createPost() {
    if (!postData) return
    const ipfsData = await uploadToIPFS()
    const createPostRequest = {
      profileId,
      contentURI: 'ipfs://' + ipfsData.path,
      collectModule: {
        freeCollectModule: { followerOnly: true }
      },
      referenceModule: {
        followerOnlyReferenceModule: false
      },
    }
    try {
      const signedResult = await signCreatePostTypedData(createPostRequest, token)
      const typedData = signedResult.result.typedData
      const { v, r, s } = splitSignature(signedResult.signature)
      const tx = await lensHub.postWithSig({
        profileId: typedData.value.profileId,
        contentURI: typedData.value.contentURI,
        collectModule: typedData.value.collectModule,
        collectModuleInitData: typedData.value.collectModuleInitData,
        referenceModule: typedData.value.referenceModule,
        referenceModuleInitData: typedData.value.referenceModuleInitData,
        sig: {
          v,
          r,
          s,
          deadline: typedData.value.deadline,
        },
      })
      console.log('successfully created post: tx hash', tx.hash)
    } catch (err) {
      console.log('error posting publication: ', err)
    }
  }
  async function uploadToIPFS() {
    const metaData = {
      version: '2.0.0',
      content: postData,
      description: postData,
      name: `Post by @${handle}`,
      external_url: `https://lenster.xyz/u/${handle}`,
      metadata_id: uuid(),
      mainContentFocus: 'TEXT_ONLY',
      attributes: [],
      locale: 'en-US',
    }

    const result = await client.query({
      query: validateMetadata,
      variables: {
        metadatav2: metaData
      }
    })
    console.log('Metadata verification request: ', result)
      
    const added = await ipfsClient.add(JSON.stringify(metaData))
    return added
  }
  function onChange(e) {
    setPostData(e.target.value)
  }
  return (
    <div>
      {
        !address && <button onClick={connect}>Connect</button>
      }
      {
        address && !session && (
          <div onClick={login}>
            <button>Login</button>
          </div>
        )
      }
      {
        address && session && (
          <div>
            <textarea
              onChange={onChange}
            />
            <button onClick={createPost}>Create Post</button>
          </div>
        )
      }
    </div>
  )
}
