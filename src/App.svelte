<script>
  import { Router, Route } from 'svelte-routing'
  import 'bulma/css/bulma.css'
  import Login from './login.svelte'
  import PoseEstimation from './poseEstimation.svelte'
  import { user } from './stores'
  import { auth } from './firebase'

  export let url = ''

  const handleLogoutClick = async () => {
    try {
      await auth.signOut()
      user.set(null)
    } catch (error) {
      console.log('%o', error)
    }
  }
</script>

<style>
  .navbar-title {
    font-family: 'VT323', monospace;
    font-size: 2rem;
  }
</style>

<svelte:head>
  <link
    href="https://fonts.googleapis.com/css2?family=VT323&display=swap"
    rel="stylesheet" />
</svelte:head>

<Router {url}>
  <nav class="navbar">
    <div class="navbar-title" style="margin: 0 20px">Virtual Walker</div>
    {#if $user}
      <div
        class="navbar-menu is-active"
        style="margin: 0 20px; align-items: center">
        <div class="navbar-start">
          <a href="/" on:click={handleLogoutClick}>ログアウト({$user.email})</a>
        </div>
      </div>
    {/if}
  </nav>
  <div>
    <Route path="poseEstimation" component={PoseEstimation} />
    <Route path="/" component={Login} />
    <Route path="/" let:location>
      <p>{location.search}</p>
    </Route>
  </div>
</Router>
