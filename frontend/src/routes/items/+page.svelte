<script lang="ts">
  import type { PageData } from "./$types";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Avatar from "$lib/components/ui/avatar/index.js";
  import { Skeleton } from "$lib/components/ui/skeleton/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";

  let { data }: { data: PageData } = $props();

  console.log(data.pagination);

  function goToPage(newPage: number) {
    const url = new URL($page.url);
    url.searchParams.set("page", newPage.toString());
    goto(url);
  }

  function previousPage() {
    if (data.pagination.page > 1) {
      goToPage(data.pagination.page - 1);
    }
  }

  function nextPage() {
    console.log("huh?");
    if (data.pagination.hasMore) {
      console.log("hello?");
      goToPage(data.pagination.page + 1);
    }
  }
</script>

<svelte:head>
  <title>Items - Demo Site</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Items</h1>
    <p class="text-gray-600 dark:text-gray-400">
      Discover and explore items from various sites
    </p>
  </div>

  {#if data.items && data.items.length > 0}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each data.items as item}
        <Card.Root class="hover:shadow-lg transition-shadow duration-200">
          <Card.Header>
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <Card.Title
                  class="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2"
                >
                  {item.title}
                </Card.Title>
                <Card.Description
                  class="text-sm text-gray-600 dark:text-gray-400 mt-1"
                >
                  {item.description || "No description available"}
                </Card.Description>
              </div>
              {#if item.thumbUrl}
                <Avatar.Root class="w-12 h-12 ml-4">
                  <Avatar.Image src={item.thumbUrl} alt={item.title} />
                  <Avatar.Fallback class="text-xs">
                    {item.title.slice(0, 2).toUpperCase()}
                  </Avatar.Fallback>
                </Avatar.Root>
              {/if}
            </div>
          </Card.Header>

          <Card.Content>
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                <Badge variant="secondary" class="text-xs">
                  Site ID: {item.siteId}
                </Badge>
                <Badge variant="outline" class="text-xs">
                  ID: {item.siteSpecificId}
                </Badge>
              </div>

              {#if item.avgRating !== null}
                <div class="flex items-center gap-2">
                  <div class="flex items-center">
                    <span
                      class="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Rating: {item.avgRating.toFixed(1)}
                    </span>
                  </div>
                  {#if item.reviewCount !== null}
                    <Badge variant="outline" class="text-xs">
                      {item.reviewCount} reviews
                    </Badge>
                  {/if}
                </div>
              {/if}

              {#if item.samples && item.samples.length > 0}
                <div>
                  <h4
                    class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Samples:
                  </h4>
                  <div class="space-y-1">
                    {#each item.samples.slice(0, 3) as sample}
                      <a
                        href={sample.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 block truncate"
                      >
                        {sample.url}
                      </a>
                    {/each}
                  </div>
                </div>
              {/if}

              {#if item.reviews && item.reviews.length > 0}
                <div>
                  <h4
                    class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Recent Reviews:
                  </h4>
                  <div class="space-y-2">
                    {#each item.reviews.slice(0, 2) as review}
                      <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded-md">
                        {#if review.title}
                          <p
                            class="text-sm font-medium text-gray-900 dark:text-white"
                          >
                            {review.title}
                          </p>
                        {/if}
                        {#if review.body}
                          <p
                            class="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-3"
                          >
                            {review.body}
                          </p>
                        {/if}
                        {#if review.rating !== null}
                          <div class="flex items-center gap-1 mt-1">
                            <span class="text-xs text-gray-500">
                              Rating: {review.rating}
                            </span>
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          </Card.Content>

          <Card.Footer>
            <a
              href={`/items/${item.siteId}/${item.siteSpecificId}`}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
            >
              View Item
            </a>
          </Card.Footer>
        </Card.Root>
      {/each}
    </div>

    <!-- Pagination Controls -->
    <div class="flex justify-center items-center gap-4 mt-8">
      <Button
        variant="outline"
        onclick={previousPage}
        disabled={data.pagination.page <= 1}
        class="px-4 py-2"
      >
        Previous
      </Button>

      <span class="text-sm text-gray-600 dark:text-gray-400">
        Page {data.pagination.page}
      </span>

      <Button
        variant="outline"
        onclick={nextPage}
        disabled={!data.pagination.hasMore}
        class="px-4 py-2"
      >
        Next
      </Button>
    </div>
  {:else}
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
              d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">
          No items found
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          There are no items available at the moment. Please check back later.
        </p>
      </div>
    </div>
  {/if}
</div>
