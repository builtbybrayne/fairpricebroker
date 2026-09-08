<svelte:head>
	<title>Method — Fair Price Broker</title>
</svelte:head>

<main class="method">
	<h1>The method</h1>
	<p>
		Each side answers the four Van Westendorp price questions in private: too cheap, a bargain,
		getting expensive, too much. The engine finds where the two ranges overlap and the price that is
		fair to both. Nobody ever sees the other side's numbers; the maths runs on the server.
	</p>
</main>

<style>
	.method {
		max-width: 720px;
		margin: 48px auto;
		padding: 0 20px;
	}
	.method p {
		margin-top: 16px;
		font-size: 18px;
		color: var(--slate);
	}
</style>
