<svelte:head>
	<title>Method — Fair Price Broker</title>
</svelte:head>

<main class="method">
	<p class="why">
		Most prices are set by whoever names a number first. Everyone knows that is not fair, so people
		stall, bluff, and walk away from deals that should have happened. There is a better way to find
		a number: ask each side, in private, where the price stops making sense for them, and let the
		overlap speak.
	</p>
	<h1>The method</h1>
	<p class="lede">
		Each side answers four quick questions in private. Those four points describe a range, and a
		range is far easier to give honestly than a single number. The instrument finds where the two
		ranges meet and the price that is fair to both. Nobody ever sees the other side's figures: you
		get the outcome, not their numbers.
	</p>

	<h2>The four points</h2>
	<p>
		The outer two are the edges of the conversation: the price that is so low it would not be
		credible, and the price that is simply out of the question. The inner two are where you would
		actually be happy: for a buyer, a bargain and the point where it starts to feel expensive; for a
		seller, an acceptable price and a genuinely good result.
	</p>

	<h2>Why the inner points matter more</h2>
	<p>
		The outer points only tell the instrument where a deal becomes impossible. The inner points tell
		it where a deal would feel good. Two people can have outer ranges that overlap widely and still
		walk away unhappy, because the price that lands between them satisfies neither. The fair price
		is found by weighing the inner points, so it sits where both sides would be content, not merely
		where neither can object.
	</p>
	<p>
		That is also why the inner points decide the kind of outcome you get. When the two inner ranges
		overlap, you are comfortably in range: a number exists that both of you would be pleased with.
		When only the outer ranges overlap, there is a deal but it is a stretch: one of you, or both,
		has to move towards a limit. When even the outer ranges miss, there is no deal at this price,
		and the instrument shows how far apart you are rather than pretending otherwise.
	</p>

	<h2>Why honesty pays</h2>
	<p>
		Because the other side never sees your figures, there is nothing to gain by shading them. A
		buyer who understates their bargain point, or a seller who inflates their acceptable price, only
		narrows the range the instrument can work with and makes a good outcome less likely for
		themselves. Setting the inner points where you truly feel them is what gets you a price you will
		be glad of.
	</p>
</main>

<style>
	.method {
		max-width: 720px;
		margin: 48px auto;
		padding: 0 20px;
	}
	.method p {
		margin-top: 14px;
		font-size: 18px;
		line-height: 1.55;
		color: var(--slate);
	}
	.method .why {
		margin: 0 0 28px;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 24px;
		line-height: 1.3;
		color: var(--navy);
		letter-spacing: -0.01em;
	}
	.method .lede {
		font-size: 20px;
		color: var(--ink);
	}
	.method h2 {
		margin-top: 36px;
		font-size: 26px;
		color: var(--navy);
	}
</style>
