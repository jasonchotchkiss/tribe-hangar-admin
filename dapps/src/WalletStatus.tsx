import { Box, Container, Flex, Text } from "@radix-ui/themes";
import { AssemblyInfo } from "./AssemblyInfo";
import { CorpVault } from "./CorpVault";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";

export function WalletStatus() {
  const account = useCurrentAccount();
  const _dAppKit = useDAppKit();

  return (
    <Container my="2">
      {account ? (
        <Flex direction="column">
          <Box>Wallet connected</Box>
          <Box>Address: {account.address}</Box>
        </Flex>
      ) : (
        <Text>Wallet not connected</Text>
      )}
      <div className="divider" />
      <AssemblyInfo />
      <CorpVault />
    </Container>
  );
}
