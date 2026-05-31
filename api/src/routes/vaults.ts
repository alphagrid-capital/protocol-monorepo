import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { ListVaultsResponseSchema } from "../schemas/vault.js";
import { listVaults } from "../services/vaults.js";

const listVaultsRoute = createRoute({
  method: "get",
  path: "/vaults",
  tags: ["Vaults"],
  summary: "List vaults",
  description:
    "Returns thematic ERC-4626 vaults with basic stats (TVL, agents, returns). Data is mocked until the indexer is connected.",
  responses: {
    200: {
      description: "Vault catalog",
      content: {
        "application/json": {
          schema: ListVaultsResponseSchema,
        },
      },
    },
  },
});

export const vaultRoutes = new OpenAPIHono();

vaultRoutes.openapi(listVaultsRoute, (c) => c.json(listVaults()));
