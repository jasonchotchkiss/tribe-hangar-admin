import { Box, Container, Flex, Heading } from "@radix-ui/themes";
import { WalletStatus } from "./WalletStatus";
import { TribeAdmin } from "./CorpAdmin";
import { abbreviateAddress, useConnection } from "@evefrontier/dapp-kit";
import { useCurrentAccount } from "@mysten/dapp-kit-react";

function App() {
  const { handleConnect, handleDisconnect } = useConnection();
  const account = useCurrentAccount();

  return (
    <Box style={{ padding: "20px" }}>
      <Flex
        position="sticky"
        px="4"
        py="2"
        direction="row"
        style={{
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <Heading>TRIBAL CONTRACT ACCESS</Heading>
        <button
          onClick={() =>
            account?.address ? handleDisconnect() : handleConnect()
          }
        >
          {account ? abbreviateAddress(account?.address) : "Connect Wallet"}
        </button>
      </Flex>
      <WalletStatus />
      <Container my="2">
        <TribeAdmin />
      </Container>
    </Box>
  );
}

export default App;
