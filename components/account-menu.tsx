"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/lib/actions/logout";
import { cn } from "@/lib/utils";

interface AccountMenuProps {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export function AccountMenu({ name, email, image }: AccountMenuProps) {
  const initials = (name || email || "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className={cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "rounded-full p-0 overflow-hidden size-8 shrink-0",
        )}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={name ?? "Avatar"}
            className="size-full object-cover pointer-events-none"
          />
        ) : (
          <span className="text-xs font-medium">{initials}</span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{name ?? "Signed in"}</span>
            {email && (
              <span className="text-muted-foreground text-xs font-normal">
                {email}
              </span>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => {
              void logoutAction();
            }}
          >
            <LogOut className="mr-2 size-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
