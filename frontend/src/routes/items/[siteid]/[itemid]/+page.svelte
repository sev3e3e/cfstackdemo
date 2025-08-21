<script lang="ts">
  import type { PageData } from "./$types";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Avatar from "$lib/components/ui/avatar/index.js";
  import { Button } from "$lib/components/ui/button/index.js";

  import { ArrowLeft } from "@lucide/svelte";

  export let data: PageData;
  $: item = data.item;
  export let data: PageData;
  $: item = data.item;

  function formatDate(dateString: string | null): string {
    if (!dateString) return "Unknown date";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Unknown date";
    }
  }
</script>

<svelte:head>
  <title>{item?.title || "Item Details"} - Demo Site</title>
  <meta
    name="description"
    content={item?.description || "View detailed information about this item"}
  />
  <title>{item?.title || "Item Details"} - Demo Site</title>
  <meta
    name="description"
    content={item?.description || "View detailed information about this item"}
  />
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-4xl">
  {#if item}
    <!-- Back navigation -->
    <div class="mb-6">
      <Button variant="outline" size="sm" onclick={() => history.back()}>
        <ArrowLeft />Back to Items
      </Button>
    </div>

    <!-- Main item details -->
    <Card.Root class="mb-8">
      <Card.Header>
        <div class="flex items-start gap-6">
          <div class="flex-1">
            <Card.Title
              class="text-2xl font-bold text-gray-900 dark:text-white mb-2"
            >
              {item.title}
            </Card.Title>
            <Card.Description
              class="text-gray-600 dark:text-gray-400 text-base"
            >
              {item.description || "No description available"}
            </Card.Description>

            <div class="flex items-center gap-3 mt-4">
              <Badge variant="secondary">
                Site ID: {item.siteId}
              </Badge>
              <Badge variant="outline">
                ID: {item.siteSpecificId}
              </Badge>
            </div>
          </div>

          {#if item.thumbUrl}
            <Avatar.Root class="w-24 h-24">
              <Avatar.Image src={item.thumbUrl} alt={item.title} />
              <Avatar.Fallback class="text-lg">
                {item.title.slice(0, 2).toUpperCase()}
              </Avatar.Fallback>
            </Avatar.Root>
          {/if}
        </div>
      </Card.Header>

      <Card.Content>
        <div class="space-y-6">
          <!-- Rating and Reviews Summary -->
          {#if item.avgRating !== null}
            <div class="flex items-center gap-4">
              <div class="flex items-center gap-1">
                <span class="text-lg"
                  ><svg viewBox="0 0 100 100" width="22" height="22">
                    <polygon
                      points="50,5 61,39 98,39 67,59 78,93 50,72 22,93 33,59 2,39 39,39"
                      fill="gold"
                    />
                  </svg>
                </span>
                <span class="text-2xl font-bold text-gray-900 dark:text-white">
                  {item.avgRating.toFixed(1)}
                </span>
              </div>
              {#if item.reviewCount !== null}
                <Badge variant="outline" class="text-sm">
                  {item.reviewCount}
                  {item.reviewCount === 1 ? "review" : "reviews"}
                </Badge>
              {/if}
            </div>
          {/if}

          <!-- External Link -->
          <div>
            <Button
              variant="default"
              size="lg"
              onclick={() => window.open(item.url, "_blank")}
              class="w-full sm:w-auto"
            >
              View Original Item
            </Button>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
          <!-- External Link -->
          <div>
            <Button
              variant="default"
              size="lg"
              onclick={() => window.open(item.url, "_blank")}
              class="w-full sm:w-auto"
            >
              View Original Item
            </Button>
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Samples Section -->
    {#if item.samples && item.samples.length > 0}
      <Card.Root class="mb-8">
        <Card.Header>
          <Card.Title
            class="text-xl font-semibold text-gray-900 dark:text-white"
          >
            Samples ({item.samples.length})
          </Card.Title>
          <Card.Description>Available samples for this item</Card.Description>
        </Card.Header>
        <Card.Content>
          <div class="space-y-3">
            {#each item.samples as sample, index}
              <div
                class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div class="flex-1">
                  <a
                    href={sample.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 font-medium break-all"
                  >
                    Sample {index + 1}
                  </a>
                  <p
                    class="text-sm text-gray-600 dark:text-gray-400 mt-1 break-all"
                  >
                    {sample.url}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => window.open(sample.url, "_blank")}
                  class="ml-4 flex-shrink-0"
                >
                  Open
                </Button>
              </div>
            {/each}
          </div>
        </Card.Content>
      </Card.Root>
    {/if}
    <!-- Samples Section -->
    {#if item.samples && item.samples.length > 0}
      <Card.Root class="mb-8">
        <Card.Header>
          <Card.Title
            class="text-xl font-semibold text-gray-900 dark:text-white"
          >
            Samples ({item.samples.length})
          </Card.Title>
          <Card.Description>Available samples for this item</Card.Description>
        </Card.Header>
        <Card.Content>
          <div class="space-y-3">
            {#each item.samples as sample, index}
              <div
                class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div class="flex-1">
                  <a
                    href={sample.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 font-medium break-all"
                  >
                    Sample {index + 1}
                  </a>
                  <p
                    class="text-sm text-gray-600 dark:text-gray-400 mt-1 break-all"
                  >
                    {sample.url}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => window.open(sample.url, "_blank")}
                  class="ml-4 flex-shrink-0"
                >
                  Open
                </Button>
              </div>
            {/each}
          </div>
        </Card.Content>
      </Card.Root>
    {/if}

    <!-- Reviews Section -->
    {#if item.reviews && item.reviews.length > 0}
      <Card.Root>
        <Card.Header>
          <Card.Title
            class="text-xl font-semibold text-gray-900 dark:text-white"
          >
            Reviews ({item.reviews.length})
          </Card.Title>
          <Card.Description>User reviews and ratings</Card.Description>
        </Card.Header>
        <Card.Content>
          <div class="space-y-6">
            {#each item.reviews as review}
              <div
                class="border-b border-gray-200 dark:border-gray-700 pb-6 last:border-b-0 last:pb-0"
              >
                <div class="flex items-start justify-between mb-3">
                  <div class="flex-1">
                    {#if review.title}
                      <h4 class="font-semibold text-gray-900 dark:text-white">
                        {review.title}
                      </h4>
                    {/if}
                    <div class="flex items-center gap-2 mt-1">
                      {#if review.rating !== null}
                        <div class="flex items-center gap-1">
                          <div class="flex items-center gap-1">
                            <svg viewBox="0 0 100 100" width="22" height="22">
                              <polygon
                                points="50,5 61,39 98,39 67,59 78,93 50,72 22,93 33,59 2,39 39,39"
                                fill="gold"
                              />
                            </svg>
                            {review.rating}
                          </div>
                          <span
                            class="text-xs text-gray-600 dark:text-gray-400"
                          >
                            / 5
                          </span>
                        </div>
                      {/if}
                      <Badge variant="outline" class="text-xs">
                        Review ID: {review.reviewId}
                      </Badge>
                    </div>
                  </div>
                  <div
                    class="text-sm text-gray-500 dark:text-gray-400 text-right"
                  >
                    {formatDate(review.createdAt)}
                  </div>
                </div>

                {#if review.body}
                  <div class="prose prose-sm max-w-none dark:prose-invert">
                    <p
                      class="text-gray-700 dark:text-gray-300 whitespace-pre-wrap"
                    >
                      {review.body}
                    </p>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </Card.Content>
      </Card.Root>
    {/if}
  {:else}
    <!-- Loading/Error State -->
    <div class="text-center py-12">
      <div class="space-y-4">
        <div class="text-gray-500 dark:text-gray-400">
          <svg
            class="mx-auto h-12 w-12 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">
          Item not found
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          The requested item could not be found or is no longer available.
        </p>
        <Button variant="outline" onclick={() => history.back()}>
          <ArrowLeft />Back to Items
        </Button>
      </div>
    </div>
  {/if}
</div>

<style>
  .prose {
    max-width: none;
  }
  .prose {
    max-width: none;
  }
</style>

