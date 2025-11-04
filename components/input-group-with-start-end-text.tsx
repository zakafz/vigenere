import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"

export default function InputGroupWithStartEndText() {
  return (
    <InputGroup>
      <InputGroupInput
        type="text"
        className="*:[input]:ps-1!"
        placeholder="coss"
        aria-label="Enter your domain"
      />
      <InputGroupAddon>
        <InputGroupText>https://</InputGroupText>
      </InputGroupAddon>
      <InputGroupAddon align="inline-end">
        <InputGroupText>.com</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  )
}
