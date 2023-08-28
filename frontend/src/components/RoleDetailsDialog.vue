<template>
  <Dialog v-model="open" :options="{ title: roleName, size: 'xs' }">
    <template #body-content>
      <label class="block text-xs text-gray-600 mt-2 mb-1">Add User</label>
      <UserSearch class="mb-4" @submit="(user) => addUser(user)" />
      <label v-if="UsersInRole.length" class="block text-xs text-gray-600 mt-2">
        Users with this role
      </label>
      <div
        v-for="user in uniqueUsers"
        :key="user.email"
        class="mt-4 flex flex-row w-full gap-2 items-center hover:bg-gray-50 rounded py-2 px-1 cursor-pointer group">
        <Avatar :image="user.user_image" :label="user.full_name" size="xl" />
        <div>
          <p class="text-gray-900 text-sm font-medium">
            {{ user.full_name }}
          </p>
          <p class="text-gray-600 text-sm">
            {{ user.email }}
          </p>
        </div>
        <Button
          class="ml-auto text-red-500 invisible group-hover:visible"
          variant="minimal"
          icon="trash-2"
          @click="
            $resources.RemoveUsersFromGroup.submit({
              group_name: roleName,
              user_emails: [user.email],
            })
          " />
      </div>
      <ErrorMessage class="mt-2" :message="errorMessage" />
      <div class="flex mt-6">
        <Button
          @click="$resources.addUsersToGroup.submit()"
          variant="solid"
          class="w-full">
          Done
        </Button>
      </div>
    </template>
  </Dialog>
</template>
<script>
import { Avatar, Dialog, ErrorMessage, Button, FeatherIcon } from "frappe-ui";
import UserSearch from "./UserSearch.vue";

export default {
  name: "RoleDetailsDialog",
  components: { Avatar, Dialog, UserSearch, ErrorMessage, Button, FeatherIcon },
  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
    roleName: {
      type: String,
      default: null,
      required: true,
    },
  },
  emits: ["update:modelValue", "success"],
  data() {
    return {
      UsersInRole: [],
      memberEmails: [],
      errorMessage: "",
    };
  },
  computed: {
    uniqueUsers() {
      return this.removeDuplicateObjects(this.UsersInRole, "email");
    },
    uniqueMemberEmails() {
      return [...new Set(this.memberEmails)];
    },
    open: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit("update:modelValue", value);
        if (!value) {
          this.newName = "";
          this.errorMessage = "";
        }
      },
    },
  },
  methods: {
    addUser(value) {
      this.UsersInRole.push(value);
      this.memberEmails.push(value.email);
    },
    removeDuplicateObjects(arr, property) {
      return [...new Map(arr.map((obj) => [obj[property], obj])).values()];
    },
  },
  resources: {
    getUsersInGroup() {
      return {
        url: "drive.utils.user_group.get_users_in_group",
        params: {
          group_name: this.roleName,
        },
        onSuccess(data) {
          this.UsersInRole = data;
          //this.uniqueUsers = data
        },
        onError(data) {
          console.log(data);
        },
        auto: true,
      };
    },
    addUsersToGroup() {
      return {
        url: "drive.utils.user_group.add_users_to_group",
        params: {
          group_name: this.roleName,
          user_emails: this.uniqueMemberEmails,
        },
        validate: () => {
          if (!this.memberEmails.length) {
            this.errorMessage = "Group needs atleast one member";
          }
        },
        onSuccess(data) {
          this.errorMessage = "";
          this.$emit("success", data);
        },
        onError(data) {
          console.log(data);
          this.errorMessage = data;
        },
        auto: false,
      };
    },
    RemoveUsersFromGroup() {
      return {
        url: "drive.utils.user_group.remove_users_from_group",
        params: {
          group_name: this.roleName,
          user_emails: null,
        },
        validate: () => {
          if (!this.memberEmails.length) {
            this.errorMessage = "Group needs atleast one member";
          }
        },
        onSuccess() {
          this.errorMessage = "";
          this.$resources.getUsersInGroup.fetch();
        },
        onError(data) {
          console.log(data);
          this.errorMessage = data;
        },
        auto: false,
      };
    },
  },
};
</script>