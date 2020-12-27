<script>
  import { navigate } from 'svelte-routing'
  import { Button } from 'svelma'
  import queryString from 'query-string'
  import { user } from './stores'
  // import { auth, provider, admin } from './firebase'
  import { auth, provider } from './firebase'

  export let location

  let queryParams
  $: queryParams = queryString.parse(location.search)

  const loginWithGoogle = async () => {
    try {
      const result = await auth.signInWithPopup(provider)
      return result
    } catch (error) {
      console.log('%o', error)
    }
  }

  const handleClick = async () => {
    const loginResponse = await loginWithGoogle()
    user.set({
      uid: loginResponse.user.uid,
      email: loginResponse.user.email,
    })
    navigate('/poseEstimation', { replace: true })
  }

  // const loginWithIdToken = async (idToken) => {
  //   const decodedToken = await admin.auth().verifyIdToken(idToken)
  //   console.log('%o', decodedToken)
  //   return decodedToken
  // }
</script>

<p>{queryParams.id_token}</p>

<!-- {#if queryParams.id_token}
  <p>{loginWithIdToken(queryParams.id_token)}</p>
{/if} -->

{#if !$user}
  <Button style="margin: 20px" on:click={handleClick}>Googleでログイン</Button>
{/if}
